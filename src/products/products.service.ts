import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PaginationDto } from 'src/common/dtos/pagination.dto';

import { Product } from './entities/product.entity';
import { validate as isUUID } from 'uuid';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger('ProductsService');

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async create(createProductDto: CreateProductDto) {
    try {
      const product = this.productRepository.create(createProductDto);
      await this.productRepository.save(product);
      return product;
    } catch (error) {
      this.handleDBExeptions(error);
    }
  }

  async findAll(paginationDto: PaginationDto) {
    const { limit = 10, offset = 0 } = paginationDto;

    const products = await this.productRepository.find({
      take: limit,
      skip: offset,
      order: {
        title: 'ASC',
      },
      //TODO:relaciones
    });
    return products;
  }

  async findOne(term: string) {
    let product: Product;

    if (isUUID(term)) {
      product = await this.productRepository.findOneBy({ id: term });
    } else {
      const queryBuilder = this.productRepository.createQueryBuilder();
      product = await queryBuilder
        .where(' upper(title) = :title or lower(slug) = :slug ', {
          title: term.toLocaleUpperCase(),
          slug: term.toLocaleLowerCase(),
        })
        .getOne();
    }

    if (!product) {
      throw new NotFoundException(`product with id ${term} not found`);
    }

    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    const product = await this.productRepository.preload({
      id: id,
      ...updateProductDto,
    });
    if (!product) {
      throw new NotFoundException(`product with id ${id} not found`);
    }
    try {
      await this.productRepository.save(product);
      return product;
    } catch (error) {
      this.handleDBExeptions(error);
    }
  }

  async remove(id: string) {
    const product = await this.findOne(id);
    await this.productRepository.remove(product);
  }

  private handleDBExeptions(error: any) {
    // current timestamp in milliseconds
    const ts = Date.now();
    const date_time = new Date(ts);
    const date = date_time.getDate();
    const month = date_time.getMonth() + 1;
    const year = date_time.getFullYear();
    // get current hours
    const hours = date_time.getHours();
    // get current minutes
    const minutes = date_time.getMinutes();
    // get current seconds
    const seconds = date_time.getSeconds();
    // prints date & time in YYYY-MM-DD format
    const fechaHora =
      date +
      '/' +
      month +
      '/' +
      year +
      ', ' +
      hours +
      ':' +
      minutes +
      ':' +
      seconds;

    if (error.code === '23505') {
      throw new BadRequestException(error.detail);
    }

    this.logger.error(error);
    throw new InternalServerErrorException(
      `Unexpecter error, check server logs - ${fechaHora}`,
    );
  }
}
