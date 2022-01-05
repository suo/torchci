import useSWR from "swr";
import { formatHudURL, HudData, HudParams, JobData, RowData } from "./types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function useHudData(params: HudParams): HudData {
  const { data } = useSWR(formatHudURL("api/hud", params), fetcher, {
    refreshInterval: 60 * 1000, // refresh every minute
    // Refresh even when the user isn't looking, so that switching to the tab
    // will always have fresh info.
    refreshWhenHidden: true,
  });

  // Add job name info back into the data (it was stripped out as technically it's redundant)
  data.shaGrid.forEach((row: RowData) => {
    row.jobs.forEach((job: JobData, index: number) => {
      job.name = data.jobNames[index];
    });
  });

  const { data: originalPRData } = useSWR(
    formatHudURL("api/original_pr_hud", params),
    fetcher,
    {
      refreshInterval: 60 * 1000,
    }
  );

  if (originalPRData !== undefined) {
    // Merge the original PR data into the main data.
    data.shaGrid.forEach((row: RowData) => {
      row.jobs.forEach((job: JobData) => {
        job.originalPrData = originalPRData[job.sha!]?.[job.name!];
      });
    });
  }
  return data;
}
