from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pandas as pd


@dataclass(slots=True)
class WorkbookClient:
    input_path: Path

    def load_sheet(self, sheet_name: str | None = None) -> pd.DataFrame:
        if self.input_path.suffix.lower() == ".csv":
            return pd.read_csv(self.input_path)
        return pd.read_excel(self.input_path, sheet_name=sheet_name)

    def iter_rows(self, sheet_name: str | None = None) -> list[dict[str, Any]]:
        return self.load_sheet(sheet_name=sheet_name).fillna("").to_dict(orient="records")

    def write_columns(
        self,
        dataframe: pd.DataFrame,
        values: list[dict[str, Any]],
        output_path: Path,
    ) -> Path:
        enriched = dataframe.copy()
        for row_index, payload in enumerate(values):
            for key, value in payload.items():
                enriched.loc[row_index, key] = value
        enriched.to_excel(output_path, index=False)
        return output_path
