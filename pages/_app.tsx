import "styles/globals.css";
import "styles/hud.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import SevReport from "components/sev-box";

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <div>
      <Head>
        <title>PyTorch CI HUD</title>
      </Head>
      <SevReport />
      <Component {...pageProps} />
    </div>
  );
}

export default MyApp;
