import { createApp } from "./app";
import { env, isAiConfigured } from "./config/env";

const app = createApp();

app.listen(env.port, () => {
  console.log(`AI Website Assistant server listening on port ${env.port}`);
  if (!isAiConfigured()) {
    console.warn(
      "[warn] ANTHROPIC_API_KEY is not set -- chat will always fall back to the human-handoff message. Set it in server/.env to enable AI answers."
    );
  }
});
