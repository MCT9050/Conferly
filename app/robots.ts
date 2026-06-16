import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/pricing", "/dashboard", "/meeting"],
      },
    ],
    sitemap: "https://www.conferly.site/sitemap.xml",
  };
}
