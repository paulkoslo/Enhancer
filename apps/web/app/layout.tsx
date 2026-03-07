import "./globals.css";

import { GlobalAgentMap } from "@/components/global-agent-map";
import { Providers } from "@/components/providers";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
          <GlobalAgentMap />
        </Providers>
      </body>
    </html>
  );
}
