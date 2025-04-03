import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class News extends Document {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  content: string;

  @Prop({ required: true })
  author: string;

  @Prop({ required: true })
  url: string;

  @Prop({ required: false })
  urlToImage?: string;

  @Prop({ required: true })
  publishedAt: Date;

  @Prop({ required: false })
  description?: string;

  @Prop({ required: false })
  sourceId?: string;

  @Prop({ required: true })
  sourceName: string;
}

// Thêm chỉ mục văn bản cho title và content

export const NewsSchema = SchemaFactory.createForClass(News);
NewsSchema.index({
  title: 'text',
  content: 'text',
  author: 'text',
  url: 'text',
  description: 'text',
  sourceName: 'text',
});
export default NewsSchema;
