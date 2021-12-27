import { GetStaticPaths, GetStaticProps } from "next";
import { useRouter } from "next/router";

// export const getStaticPaths: GetStaticPaths = async () => {
//   return { paths: [{ params: { page: "0" } }], fallback: true };
// };

export default function Hud() {
  const router = useRouter();

  return (
    <div>
      <h1 id="hud-header">
        PyTorch Commit: <code>{router.query.sha}</code>
      </h1>
      <a href="=">GitHub</a>
      <a href="">| Phabricator</a>
      <article className="commit-message>"></article>
      <div className="commit-failed-jobs">
        <h2>Failed jobs</h2>
        <ul>
          <li>
            conclusion, log url, html_url
            <details>
              <summary>
                <code>*failureline*</code>
              </summary>
              STUFF
            </details>
          </li>
        </ul>
      </div>
      <div className="commit-pending-jobs">
        <h2>Pending jobs</h2>
        <ul>
          <li>html_url, job name</li>
        </ul>
      </div>
      <div className="workflow-container">
          <div className="workflow-box-pass">
              <h3>workflow</h3>
              <ul>
                  <li>span, logurl, htmlurl, name</li>
              </ul>
          </div>

      </div>
    </div>
  );
}
// export const getStaticProps: GetStaticProps = async ({ params }) => {
//   const pageIndex = params!.page ? parseInt(params!.page as string) : 0;
//   const fallback: any = {};
//   fallback[`/api/hud?page=${pageIndex}`] = await fetchHud(pageIndex);
//   return {
//     props: {
//       fallback,
//     },
//     revalidate: 600, // Every 10 minutes.
//   };
// };
