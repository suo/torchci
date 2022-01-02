import { JobData } from "lib/types";
import { useEffect, useState } from "react";
import useSWRImmutable from "swr";
import Editor, { useMonaco } from "@monaco-editor/react";
import { registerLogLanguage } from "lib/log-utils";

const fetcher = (url: string) => fetch(url).then((res) => res.text());
function Log({ url, line }: { url: string; line: number }) {
  const monaco = useMonaco();

  useEffect(() => {
    monaco?.languages.typescript.javascriptDefaults.setEagerModelSync(true);
  }, [monaco]);
  const { data, isValidating } = useSWRImmutable(url, fetcher);

  if (isValidating) {
    return (
      <div>
        <em>loading...</em>
      </div>
    );
  }

  return (
    <Editor
      height="90vh"
      defaultLanguage="logText"
      defaultValue={data}
      theme="logTheme"
      beforeMount={(monaco) => registerLogLanguage(monaco)}
      line={line + 1}
      options={{
        scrollBeyondLastLine: false,
        lineNumbersMinChars: 6,
        readOnly: true,
        minimap: { enabled: false },
      }}
      onMount={(editor, monaco) => {
        editor.deltaDecorations(
          [],
          [
            {
              range: {
                startLineNumber: line + 1,
                endLineNumber: line + 1,
                startColumn: 1,
                endColumn: 1,
              },
              options: { isWholeLine: true, className: "highlight-log-line" },
            },
          ]
        );
        let foldAction = editor.getAction("editor.foldAll");
        foldAction.run().then(() => {
          editor.revealLineInCenter(line + 1);
        });
      }}
    />
  );
}

export default function LogViewer({ job }: { job: JobData }) {
  const [showLogViewer, setShowLogViewer] = useState(false);
  if (job.failureContext === null) {
    return null;
  }

  function handleClick() {
    setShowLogViewer(!showLogViewer);
  }

  return (
    <div>
      <details>
        <summary>
          <code style={{ cursor: "pointer" }} onClick={handleClick}>
            {job.failureLine}
          </code>
        </summary>
        {showLogViewer && (
          <Log url={job.logUrl!} line={job.failureLineNumber!} />
        )}
      </details>
    </div>
  );
}
