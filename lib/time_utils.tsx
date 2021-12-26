import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

export function LocalTimeHuman({ timestamp }: { timestamp: string }) {
  const time = dayjs(timestamp).local();

  if (dayjs().isSame(time, "day")) {
    return <span>{time.format("h:mm A")}</span>;
  } else {
    return <span>{time.format("ddd, MMM D")}</span>;
  }
}

// from: https://gist.github.com/g1eb/62d9a48164fe7336fdf4845e22ae3d2c
export function durationHuman(seconds: number) {
  var hours = Math.floor(seconds / 3600);
  var minutes = Math.floor((seconds - hours * 3600) / 60);
  var seconds = seconds - hours * 3600 - minutes * 60;
  if (!!hours) {
    if (!!minutes) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else {
      return `${hours}h ${seconds}s`;
    }
  }
  if (!!minutes) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}
