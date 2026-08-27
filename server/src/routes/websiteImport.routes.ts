import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { requireAuth, requireCustomerScope } from "../middleware/auth";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { crawlWebsite } from "../lib/crawler/crawl";

export const websiteImportRouter = Router();
websiteImportRouter.use(requireAuth, requireCustomerScope);

websiteImportRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const jobs = await prisma.websiteImportJob.findMany({
      where: { customerId: req.auth!.customerId! },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { items: true } } },
    });
    res.json(jobs);
  })
);

const importSchema = z.object({ url: z.string().url() });

// Crawled content is imported as DRAFT knowledge -- it never becomes part
// of the live, AI-searchable knowledge base (status ACTIVE) until the
// customer reviews and approves it. This satisfies "do not automatically
// trust every piece of text from the website."
websiteImportRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = importSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "Invalid URL");
    const customerId = req.auth!.customerId!;

    const job = await prisma.websiteImportJob.create({
      data: { customerId, url: parsed.data.url, status: "CRAWLING" },
    });

    try {
      const pages = await crawlWebsite(parsed.data.url);
      await prisma.$transaction([
        ...pages.map((p) =>
          prisma.knowledgeItem.create({
            data: {
              customerId,
              type: "WEBSITE",
              title: p.title || p.url,
              content: p.text,
              source: "WEBSITE",
              status: "DRAFT",
              websiteImportId: job.id,
            },
          })
        ),
        prisma.websiteImportJob.update({
          where: { id: job.id },
          data: { status: "REVIEW", pagesFound: pages.length },
        }),
      ]);
      res.status(201).json({ ...job, status: "REVIEW", pagesFound: pages.length });
    } catch (err) {
      await prisma.websiteImportJob.update({
        where: { id: job.id },
        data: { status: "FAILED", errorMessage: err instanceof Error ? err.message : "Crawl failed" },
      });
      res.status(201).json({ ...job, status: "FAILED" });
    }
  })
);
