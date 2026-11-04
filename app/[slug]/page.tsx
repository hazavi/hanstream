import { fetchDrama } from "@/lib/api";
import { DramaDetails } from "@/components/DramaDetails";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { parseCatalogRoute } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const resolvedParams = await params;
  try {
    const data = await fetchDrama(resolvedParams.slug);
    const title =
      (data.result && typeof data.result.title === "string"
        ? data.result.title
        : undefined) || resolvedParams.slug;
    const description =
      (typeof data.result?.description === "string"
        ? data.result.description.slice(0, 160)
        : undefined);
    const image =
      typeof data.result?.image === "string" ? data.result.image : undefined;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        images: image ? [{ url: image }] : [],
      },
    };
  } catch {
    return { title: resolvedParams.slug };
  }
}

export default async function DramaDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!parseCatalogRoute(slug) && !/^(movie-)?\d+$/.test(slug)) notFound();
  const { result } = await fetchDrama(slug);
  return result ? <DramaDetails detail={result} slug={slug} /> : <p className="source-empty">Drama details are unavailable.</p>;
}
