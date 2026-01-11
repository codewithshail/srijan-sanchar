"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type PublicStory = {
  id: string
  title: string | null
  visibility: "public_summary" | "public_long"
  summarySnippet: string
}

export default function ExplorePage() {
  const { data, isLoading } = useQuery<PublicStory[]>({
    queryKey: ["public-stories"],
    queryFn: async () => {
      const res = await fetch("/api/public")
      if (!res.ok) throw new Error("Failed to fetch")
      return res.json()
    },
  })

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-6 text-center">Discover Stories</h1>
      {isLoading && <p>Loading...</p>}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {data?.map((s) => (
          <Link key={s.id} href={`/story/${s.id}`}>
            <Card className="h-full hover:border-primary">
              <CardHeader>
                <CardTitle className="line-clamp-1">{s.title ?? "Untitled Story"}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-4">{s.summarySnippet}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
