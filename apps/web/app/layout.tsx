import "./globals.css";

import { GlobalAgentMap } from "@/components/global-agent-map";
import { Providers } from "@/components/providers";
import { ViewMenu } from "@/components/view-menu";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <ViewMenu />
          {children}
          <GlobalAgentMap />
        </Providers>
      </body>
    </html>
  );
}
