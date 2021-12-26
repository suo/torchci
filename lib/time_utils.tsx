export function LocalTimeHuman({ timestamp }: { timestamp: string }) {
  const time = new Date(timestamp);
  const today = new Date();

  const isToday =
    time.getFullYear() === today.getFullYear() &&
    time.getMonth() === today.getMonth() &&
    time.getDate() === today.getDate();

  const humanFormattedTime = isToday
    ? // "6:55 PM"
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "numeric",
      }).format(time)
    : // "Wed, Dec 8"
      new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }).format(time);
  return <span>{humanFormattedTime}</span>;
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
