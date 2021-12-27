import type { NextApiRequest, NextApiResponse } from "next";
import fetchHud from "../../lib/fetch_hud";
import { HudData } from "../../lib/types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<HudData>
) {
  res.status(200).json(await fetchHud());
}
