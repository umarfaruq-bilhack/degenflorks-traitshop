import Providers from "./providers";
import "./globals.css";

export const metadata = {
  title: "Degen Florks Trait Shop",
  description: "Customize your Florks with purchasable traits.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
