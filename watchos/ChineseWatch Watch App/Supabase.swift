import Foundation

// Same project + publishable key as src/lib/supabase.ts — RLS gates what
// the key can do, so embedding it in the watch bundle is safe.
enum SupabaseConfig {
    static let url = URL(string: "https://oigbbgtzzqiceetasayy.supabase.co")!
    static let anonKey = "sb_publishable_YTd6bXMqUddNj4aFf1YRwA_T320qu3c"
}

struct SupabaseError: Error, LocalizedError {
    let status: Int?
    let message: String
    var errorDescription: String? { message }
    var isAuthFailure: Bool {
        guard let status else { return false }
        return status == 401 || status == 403
    }
}

struct Session: Codable, Equatable {
    var accessToken: String
    var refreshToken: String
    var expiresAt: Date
    var userId: String
    var email: String
}

struct DueRow: Decodable {
    let itemKey: String
    let facet: String
    let dueAt: Date

    enum CodingKeys: String, CodingKey {
        case itemKey = "item_key"
        case facet
        case dueAt = "due_at"
    }
}

struct Word: Decodable, Identifiable {
    let word: String
    let pinyin: String
    let definitions: [String]
    let hsk: Int?
    let rank: Int?
    var id: String { word }

    enum CodingKeys: String, CodingKey {
        case word, pinyin, definitions, hsk, rank
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        word = try c.decode(String.self, forKey: .word)
        pinyin = (try? c.decode(String.self, forKey: .pinyin)) ?? ""
        definitions = (try? c.decode([String].self, forKey: .definitions)) ?? []
        hsk = try? c.decodeIfPresent(Int.self, forKey: .hsk)
        rank = try? c.decodeIfPresent(Int.self, forKey: .rank)
    }

    init(word: String, pinyin: String, definitions: [String], hsk: Int?, rank: Int?) {
        self.word = word
        self.pinyin = pinyin
        self.definitions = definitions
        self.hsk = hsk
        self.rank = rank
    }
}

enum Supabase {
    // PostgREST returns timestamptz with fractional seconds and a colon in
    // the offset; GoTrue hands back plain unix seconds. Try both ISO forms.
    static func parseDate(_ s: String) -> Date? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: s) { return d }
        f.formatOptions = [.withInternetDateTime]
        return f.date(from: s)
    }

    static func isoNow() -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f.string(from: Date())
    }

    private static func errorMessage(from data: Data, status: Int) -> String {
        if let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            for key in ["msg", "message", "error_description", "error"] {
                if let m = obj[key] as? String, !m.isEmpty { return m }
            }
        }
        return "Request failed (\(status))"
    }

    private static func send(_ req: URLRequest) async throws -> Data {
        let (data, resp): (Data, URLResponse)
        do {
            (data, resp) = try await URLSession.shared.data(for: req)
        } catch {
            throw SupabaseError(status: nil, message: error.localizedDescription)
        }
        let status = (resp as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            throw SupabaseError(status: status, message: errorMessage(from: data, status: status))
        }
        return data
    }

    private static func authRequest(path: String, query: String? = nil, body: [String: Any]) throws -> URLRequest {
        var comps = URLComponents(url: SupabaseConfig.url.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
        comps.query = query
        var req = URLRequest(url: comps.url!)
        req.httpMethod = "POST"
        req.setValue(SupabaseConfig.anonKey, forHTTPHeaderField: "apikey")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        return req
    }

    private static func session(fromTokenResponse data: Data) throws -> Session {
        guard let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let access = obj["access_token"] as? String,
              let refresh = obj["refresh_token"] as? String,
              let user = obj["user"] as? [String: Any],
              let userId = user["id"] as? String
        else {
            throw SupabaseError(status: nil, message: "Unexpected auth response")
        }
        let expiresAt: Date
        if let unix = obj["expires_at"] as? TimeInterval {
            expiresAt = Date(timeIntervalSince1970: unix)
        } else if let expiresIn = obj["expires_in"] as? TimeInterval {
            expiresAt = Date().addingTimeInterval(expiresIn)
        } else {
            expiresAt = Date().addingTimeInterval(3600)
        }
        return Session(
            accessToken: access,
            refreshToken: refresh,
            expiresAt: expiresAt,
            userId: userId,
            email: user["email"] as? String ?? ""
        )
    }

    // MARK: - Auth (same email one-time-code flow as the web app)

    static func requestCode(email: String) async throws {
        let req = try authRequest(path: "auth/v1/otp", body: ["email": email, "create_user": true])
        _ = try await send(req)
    }

    static func verifyCode(email: String, code: String) async throws -> Session {
        let req = try authRequest(
            path: "auth/v1/verify",
            body: ["type": "email", "email": email, "token": code.trimmingCharacters(in: .whitespaces)]
        )
        return try session(fromTokenResponse: try await send(req))
    }

    static func refresh(refreshToken: String) async throws -> Session {
        let req = try authRequest(
            path: "auth/v1/token",
            query: "grant_type=refresh_token",
            body: ["refresh_token": refreshToken]
        )
        return try session(fromTokenResponse: try await send(req))
    }

    // MARK: - Data

    private static func get(path: String, queryItems: [URLQueryItem], session: Session) async throws -> Data {
        var comps = URLComponents(url: SupabaseConfig.url.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
        comps.queryItems = queryItems
        var req = URLRequest(url: comps.url!)
        req.setValue(SupabaseConfig.anonKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        return try await send(req)
    }

    static func dueWordRows(session: Session) async throws -> [DueRow] {
        let data = try await get(
            path: "rest/v1/user_fsrs_state",
            queryItems: [
                URLQueryItem(name: "select", value: "item_key,facet,due_at"),
                URLQueryItem(name: "item_kind", value: "eq.word"),
                URLQueryItem(name: "due_at", value: "lte.\(isoNow())"),
                URLQueryItem(name: "order", value: "due_at.asc"),
                URLQueryItem(name: "limit", value: "400"),
            ],
            session: session
        )
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { d in
            let s = try d.singleValueContainer().decode(String.self)
            guard let date = parseDate(s) else {
                throw DecodingError.dataCorrupted(.init(codingPath: d.codingPath, debugDescription: "Bad date: \(s)"))
            }
            return date
        }
        return try decoder.decode([DueRow].self, from: data)
    }

    static func fetchWords(_ keys: [String], session: Session) async throws -> [Word] {
        guard !keys.isEmpty else { return [] }
        let list = keys.map { "\"\($0)\"" }.joined(separator: ",")
        let data = try await get(
            path: "rest/v1/words",
            queryItems: [
                URLQueryItem(name: "select", value: "word,pinyin,definitions,hsk,rank"),
                URLQueryItem(name: "word", value: "in.(\(list))"),
            ],
            session: session
        )
        return try JSONDecoder().decode([Word].self, from: data)
    }
}
