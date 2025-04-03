import { Controller, Get, Query } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { NewsService } from './news.service';

@ApiTags('news')
@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get('clear-data')
  clearData() {
    return this.newsService.clearData();
  }

  @Get('re-index')
  reIndex() {
    return this.newsService.reIndex();
  }

  @Get('re-index-elasticsearch')
  reIndexElasticsearch() {
    return this.newsService.reIndexToElasticsearch();
  }

  @Get('search')
  @ApiQuery({ name: 'q', required: true, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  async search(
    @Query('q') query: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    return this.newsService.search(query, page, limit);
  }
  @Get('run-seed')
  @ApiQuery({
    name: 'maxRecords',
    required: false,
    type: Number,
    example: 2000,
  })
  runSeed(@Query('maxRecords') maxRecords: number = 2000) {
    return this.newsService.runSeed(maxRecords);
  }

  @Get()
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'search', required: false, type: String })
  async getNews(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('search') search?: string,
  ) {
    const time = Date.now();
    return this.newsService.getNews(page, limit, search).then((data) => {
      const latency = Date.now() - time;
      data['latency'] = latency + 'ms';
      return data;
    });
  }
}
