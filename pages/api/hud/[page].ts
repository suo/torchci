import type { NextApiRequest, NextApiResponse } from "next";
import fetchHud from "../../../lib/fetch-hud";
import { HudData } from "../../../lib/types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<HudData>
) {
  let page: number = 0;
  if (req.query.page !== undefined) {
    page = parseInt(req.query.page as string);
  }
  res.status(200).json(await fetchHud(page));
}
