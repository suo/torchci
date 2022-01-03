import type { NextApiRequest, NextApiResponse } from "next";
import fetchHud from "lib/fetchHud";
import { HudData, packHudParams } from "lib/types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<HudData>
) {
  const params = packHudParams(req.query);
  res.status(200).json(await fetchHud(params));
}
