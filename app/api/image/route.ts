import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";
import { z } from "zod";

const bodySchema = z.object({
	prompt: z.string().min(3).max(160), // we will trim to 40 words
});

export async function POST(req: NextRequest) {
	const parsed = bodySchema.safeParse(await req.json());
	if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
	const { prompt } = parsed.data;

	const token = process.env.REPLICATE_API_TOKEN;
	if (!token) return NextResponse.json({ error: "Missing REPLICATE_API_TOKEN" }, { status: 500 });

	const model: `${string}/${string}` | `${string}/${string}:${string}` =
		(process.env.REPLICATE_MODEL as `${string}/${string}` | `${string}/${string}:${string}`) ||
		"black-forest-labs/FLUX.1-schnell";
	const shortPrompt = prompt.split(/\s+/).slice(0, 40).join(" ");
	const replicate = new Replicate({ auth: token });
	const output = await replicate.run(model, {
		input: {
			prompt: shortPrompt,
		}
	});

	// Output shape can vary; normalize to first URL string if array
	const url = Array.isArray(output) ? String(output[0]) : String(output);
	return NextResponse.json({ url, prompt: shortPrompt });
}


