import logger from "../logger";

interface Pagination {
  result: any[];
  next_page: number;
}

export default async (
  model: any,
  page: number,
  limit: number,
  pipeline: { [key: string]: any }[]
): Promise<Pagination> => {
  try {
    const skip = page > 0 ? (page - 1) * limit : 0;

    const aggregation = await model
      .aggregate(pipeline)
      .skip(skip)
      .limit(limit)
      .project({ _id: 0, __v: 0 });

    let nextPage = -1;
    if (aggregation.length) {
      const nextPageSkip = (page + 1 - 1) * limit;

      const nextPageResult = await model
        .aggregate(pipeline)
        .skip(nextPageSkip)
        .limit(limit)
        .project({ _id: 0, __v: 0 });

      nextPage = nextPageResult.length ? page + 1 : nextPage;
    }

    return {
      result: aggregation,
      next_page: nextPage
    };
  } catch (err) {
    logger.child({ error: err }).error("Failed to return pagination");

    throw err;
  }
};
