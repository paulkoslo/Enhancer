import { downloadDryRunUrl, downloadRunUrl } from "@/lib/api";


describe("api helpers", () => {
  it("builds download urls", () => {
    expect(downloadRunUrl("run-123")).toContain("/runs/run-123/download");
    expect(downloadDryRunUrl("run-123")).toContain("/runs/run-123/dry-run/download");
  });
});
