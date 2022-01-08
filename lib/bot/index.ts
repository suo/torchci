import autoCcBot from "./auto-cc-bot";
import autoLabelBot from "./auto-label-bot";
import verifyDisableTestIssueBot from "./verify-disable-test-issue";
import { CIFlowBot } from "./ciflow-bot";
import { Probot } from "probot";
import ciflowPushTrigger from "./ciflow-push-trigger";

export default function registerBot(app: Probot): void {
  autoCcBot(app);
  autoLabelBot(app);
  verifyDisableTestIssueBot(app);
  ciflowPushTrigger(app);
  CIFlowBot.main(app);
}
