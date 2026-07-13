import type { Meta, StoryObj } from "@storybook/react-vite";
import { SignInModal } from "./SignInModal";

const meta = {
  title: "Auth/SignInModal",
  component: SignInModal,
  parameters: { layout: "fullscreen" },
  args: {
    onClose: () => {},
    onSignIn: async () => ({ error: null }),
    onVerifyCode: async () => ({ error: "Story mode — code not checked" }),
  },
} satisfies Meta<typeof SignInModal>;
export default meta;
type Story = StoryObj<typeof meta>;

// Enter an email and submit to see the code-entry step (the story stub
// "sends" instantly); submitting a code surfaces the error state.
export const EmailStep: Story = {};
