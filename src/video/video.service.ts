import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { CloudinaryUpload } from 'src/utils/coudinary-upload';
import { errorhandler, successHandler } from 'src/utils/response.handler';
import { Repository } from 'typeorm';
import { Video } from '../entities/video.entity';
import { CreateUpdateVideoDto } from './dto/createUpdateVideo.dto';

@Injectable()
export class VideoService {
  constructor(@InjectRepository(Video) private videoRepo: Repository<Video>) {}

  async findAllVideos() {
    const videos = await this.videoRepo.find();
    return successHandler('Video found', videos);
  }

  async findVideoById(id: string) {
    const video = await this.videoRepo.findBy({ id: id });
    return video;
  }

  async findVideosByGenre(genre: string) {
    const videos = await this.videoRepo.findBy({ genre: genre });
    return videos;
  }

  async searchVideos(keyword: string) {
    const videos = await this.videoRepo
      .createQueryBuilder('video')
      .where('video.title LIKE :keyword', { keyword: `%${keyword}%` })
      .orWhere('video.genre LIKE :keyword', { keyword: `%${keyword}%` })
      .orWhere('video.short_desc LIKE :keyword', { keyword: `%${keyword}%` })
      .orWhere('video.about LIKE :keyword', { keyword: `%${keyword}%` })
      .orWhere('video.primary_lesson LIKE :keyword', {
        keyword: `%${keyword}%`,
      })
      .orWhere('video.theme LIKE :keyword', { keyword: `%${keyword}%` })
      .orWhere('video.impact LIKE :keyword', { keyword: `%${keyword}%` })
      .getMany();
    return videos;
  }

  async createVideo(
    thumbnail: Express.Multer.File,
    attributes: CreateUpdateVideoDto,
  ) {
    const cloudinaryUpload = await CloudinaryUpload(
      thumbnail,
      'thumbnails',
      randomUUID(),
    );

    const video_url = cloudinaryUpload.secure_url;

    const video = this.videoRepo.create({
      ...attributes,
      video_url: video_url,
    });
    const newVideo = await this.videoRepo.save(video);
    return successHandler('Video created successfully', newVideo);
  }

  async updateVideo(id: string, attributes: Partial<Video>) {
    const video = await this.videoRepo.findBy({ id: id });
    if (!video) return errorhandler(404, 'Video not found');
    Object.assign(video, attributes);
    const updatedVideo = await this.videoRepo.save(video);
    return successHandler('Video updated successfully', updatedVideo);
  }

  async deleteVideo(id: string) {
    const video = await this.videoRepo.findBy({ id: id });
    if (!video) return errorhandler(404, 'Video not found');
    await this.videoRepo.remove(video);
    return successHandler('Video deleted successfully', null);
  }
}
