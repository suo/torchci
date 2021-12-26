export function getCharForConclusion(conclusion) {
  let conclusionChar;
  switch (conclusion) {
    case "success":
      conclusionChar = "O";
      break;
    case "failure":
      conclusionChar = "X";
      break;
    case "neutral":
      conclusionChar = "N";
      break;
    case "cancelled":
      conclusionChar = "C";
      break;
    case "timed_out":
      conclusionChar = "T";
      break;
    case "skipped":
      conclusionChar = "S";
      break;
    case "pending":
      conclusionChar = "?";
      break;
    default:
      // shouldn't happen
      conclusionChar = "U";
  }
  return conclusionChar;
}
