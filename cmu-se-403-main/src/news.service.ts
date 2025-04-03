import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { News } from './schemas/news.schema';
import { faker } from '@faker-js/faker';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import {
  BulkResponse,
  SearchResponse,
} from '@elastic/elasticsearch/lib/api/types';

@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);

  constructor(
    @InjectModel(News.name) private newsModel: Model<News>,
    private readonly elasticsearchService: ElasticsearchService,
  ) {}

  async clearData() {
    try {
      await this.newsModel.deleteMany({});
      this.logger.log('Data cleared successfully');
    } catch (error) {
      this.logger.error('Error clearing data', error);
      throw new InternalServerErrorException('Failed to clear data');
    }
  }

  async runSeed(maxRecords: number = 2000, batchSize: number = 100) {
    this.logger.log(`Seeding ${maxRecords} fake news records...`);

    const bulkOps = [];
    let currentRecordCount = 0;

    while (currentRecordCount < maxRecords) {
      const fakeNews = {
        title: faker.lorem.sentence(),
        content: faker.lorem.paragraphs(3),
        author: faker.person.fullName(),
        url: faker.internet.url(),
        urlToImage: faker.image.url(),
        publishedAt: faker.date.past(),
        description: faker.lorem.sentences(2),
        sourceId: faker.string.uuid(),
        sourceName: faker.company.name(),
      };

      bulkOps.push({
        updateOne: {
          filter: { url: fakeNews.url }, // Ensure uniqueness by URL
          update: { $set: fakeNews },
          upsert: true,
        },
      });

      currentRecordCount++;

      // Execute bulk operation when reaching batch size
      if (bulkOps.length === batchSize) {
        await this.newsModel.bulkWrite(bulkOps);
        this.logger.log(`Inserted/Updated ${currentRecordCount} records...`);
        bulkOps.length = 0; // Clear the operations array to free up memory
      }
    }

    // Insert any remaining operations after the loop
    if (bulkOps.length > 0) {
      await this.newsModel.bulkWrite(bulkOps);
      this.logger.log(`Inserted/Updated ${currentRecordCount} records...`);
    }

    this.logger.log(
      `Seeding completed successfully. Inserted/Updated ${currentRecordCount} records.`,
    );
  }

  async reIndex(batchSize: number = 100) {
    try {
      const totalRecords = await this.newsModel.countDocuments().exec();
      this.logger.log(`Total records to reindex: ${totalRecords}`);

      for (let skip = 0; skip < totalRecords; skip += batchSize) {
        const allNews = await this.newsModel
          .find(
            {},
            '_id title content author url urlToImage publishedAt description sourceId sourceName',
          )
          .skip(skip)
          .limit(batchSize)
          .exec();

        const bulkOps = allNews.map((record) => ({
          updateOne: {
            filter: { _id: record._id },
            update: {
              $set: {
                title: record.title || 'No Title',
                content: record.content || 'No Content',
                author: record.author || 'Unknown Author',
                url: record.url || '',
                urlToImage: record.urlToImage || '',
                publishedAt: record.publishedAt || new Date(),
                description: record.description || '',
                sourceId: record.sourceId || '',
                sourceName: record.sourceName || 'Unknown Source',
              },
            },
          },
        }));

        await this.newsModel.bulkWrite(bulkOps);
        this.logger.log(
          `Reindexed ${Math.min(skip + batchSize, totalRecords)} of ${totalRecords} records`,
        );

        // Optional: Add a delay if necessary to avoid overwhelming the database
        // await new Promise(resolve => setTimeout(resolve, 100));
      }

      this.logger.log('Reindexing completed successfully');
    } catch (error) {
      this.logger.error('Error during reindexing', error);
      throw new InternalServerErrorException('Failed to reindex news');
    }
  }

  async reIndexToElasticsearch(batchSize: number = 100) {
    try {
      const totalRecords = await this.newsModel.countDocuments().exec();
      this.logger.log(
        `Total records to reindex to Elasticsearch: ${totalRecords}`,
      );

      for (let skip = 0; skip < totalRecords; skip += batchSize) {
        const allNews = await this.newsModel
          .find({})
          .skip(skip)
          .limit(batchSize)
          .exec();

        const body = allNews.flatMap((doc) => [
          { index: { _index: 'news', _id: doc._id.toString() } },
          {
            title: doc.title,
            content: doc.content,
            author: doc.author,
            url: doc.url,
            urlToImage: doc.urlToImage,
            publishedAt: doc.publishedAt,
            description: doc.description,
            sourceId: doc.sourceId,
            sourceName: doc.sourceName,
          },
        ]);

        // Bulk indexing to Elasticsearch
        if (body.length > 0) {
          const bulkResponse: BulkResponse =
            await this.elasticsearchService.bulk({ refresh: true, body });
          if (bulkResponse.errors) {
            this.logger.error(
              'Errors occurred during bulk indexing',
              bulkResponse.errors,
            );
            throw new InternalServerErrorException(
              'Failed to reindex news to Elasticsearch',
            );
          }
          this.logger.log(
            `Reindexed ${Math.min(skip + batchSize, totalRecords)} of ${totalRecords} records to Elasticsearch`,
          );
        }
      }

      this.logger.log('Reindexing to Elasticsearch completed successfully');
    } catch (error) {
      this.logger.error('Error during reindexing to Elasticsearch', error);
      throw new InternalServerErrorException(
        'Failed to reindex news to Elasticsearch',
      );
    }
  }

  async search(query: string, page: number = 1, limit: number = 10) {
    try {
      // Execute the search query
      const response: SearchResponse<unknown> =
        await this.elasticsearchService.search({
          index: 'news',
          from: (page - 1) * limit,
          size: limit,
          body: {
            query: {
              multi_match: {
                query,
                fields: ['title', 'content', 'author', 'description'],
              },
            },
          },
        });

      // Handle the total hits count
      const total =
        typeof response.hits.total === 'number'
          ? response.hits.total
          : response.hits.total.value;

      const hits = response.hits.hits.map((hit) => {
        const source = hit._source as Record<string, unknown>; // Type assertion to ensure _source is an object
        return {
          id: hit._id,
          ...source,
        };
      });

      this.logger.log(
        `Search completed: found ${total} results for query "${query}"`,
      );

      return { data: hits, total };
    } catch (error) {
      this.logger.error('Error during Elasticsearch search', error);
      throw new InternalServerErrorException('Failed to search news');
    }
  }

  async getNews(page: number, limit: number, search?: string) {
    try {
      const query = search ? { $text: { $search: search } } : {};

      const [news, total] = await Promise.all([
        this.newsModel
          .find(query)
          .skip((page - 1) * limit)
          .limit(limit)
          .exec(),
        this.newsModel.countDocuments(query),
      ]);

      this.logger.log(`Search query: ${JSON.stringify(query)}`);
      this.logger.log(`Total records found: ${total}`);

      return { data: news, total };
    } catch (error) {
      this.logger.error('Error fetching news', error);
      throw new InternalServerErrorException('Failed to fetch news');
    }
  }
}
