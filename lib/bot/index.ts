import { Probot } from "probot";
import ciflowPushTrigger from "./ciflowPushTrigger";

export default function bot(app: Probot) {
  ciflowPushTrigger(app);
}
