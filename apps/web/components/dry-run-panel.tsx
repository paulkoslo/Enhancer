import type { RowResult } from "@/lib/api";

export function DryRunPanel({
  results,
  variant = "developer",
}: {
  results: RowResult[];
  variant?: "developer" | "user";
}) {
  const isUserView = variant === "user";

  if (!results.length) {
    return <div className="card muted">{isUserView ? "Es liegen noch keine Testlauf-Ergebnisse vor." : "No dry-run results yet."}</div>;
  }

  const columns = Array.from(
    new Set(
      results.flatMap((result) => Object.keys(result.output_json)),
    ),
  );

  return (
    <div className="table-wrap bounded">
      <table className="data-table">
        <thead>
          <tr>
            <th>{isUserView ? "Zeile" : "Row"}</th>
            <th>{isUserView ? "Status" : "Status"}</th>
            <th>{isUserView ? "Sicherheit" : "Confidence"}</th>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {results.map((result) => (
            <tr key={result.row_index}>
              <td>{result.row_index}</td>
              <td>{result.status}</td>
              <td>{result.confidence.toFixed(2)}</td>
              {columns.map((column) => (
                <td key={column}>
                  <CellValue value={String(result.output_json[column] ?? "")} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CellValue({ value }: { value: string }) {
  return (
    <div className="cell-value" title={value}>
      {value || "—"}
    </div>
  );
}
