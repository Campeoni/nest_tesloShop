import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PaginationDto } from 'src/common/dtos/pagination.dto';

import { Product, ProductImage } from './entities';
import { validate as isUUID } from 'uuid';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger('ProductsService');

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,

    @InjectRepository(ProductImage)
    private readonly productImageRepository: Repository<ProductImage>,

    private readonly dataSource: DataSource,
  ) {}

  async create(createProductDto: CreateProductDto) {
    try {
      const { images = [], ...productDetails } = createProductDto;

      const product = this.productRepository.create({
        ...productDetails,
        images: images.map((image) =>
          this.productImageRepository.create({ url: image }),
        ),
      });

      await this.productRepository.save(product);

      //esto se hace para que no retorne la estructura con los id de la relacion
      /*  Como lo devuelve si ponemos return product  
        "images": [
          {
              "url": "http://image1.jpg",
              "id": 1
          },
          {
              "url": "http://image2.jpg",
              "id": 2
          }
        ],
      */
      /*  Como lo devuelve con el cambio en el return
        "images": [
            "http://image3.jpg",
            "http://image4.jpg"
        ],
      */
      return { ...product, images: images };
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
      relations: {
        images: true,
      },
    });

    return products.map(({ images, ...rest }) => ({
      rest,
      images: images.map((img) => img.url),
    }));
  }

  async findOne(term: string) {
    let product: Product;

    if (isUUID(term)) {
      product = await this.productRepository.findOneBy({ id: term });
    } else {
      const queryBuilder = this.productRepository.createQueryBuilder('prod');
      product = await queryBuilder
        .where(' upper(title) = :title or lower(slug) = :slug ', {
          title: term.toLocaleUpperCase(),
          slug: term.toLocaleLowerCase(),
        })
        .leftJoinAndSelect('prod.images', 'prodImages')
        .getOne();
    }

    if (!product) {
      throw new NotFoundException(`product with id ${term} not found`);
    }

    return product;
  }

  async findOnePlain(term: string) {
    const { images = [], ...rest } = await this.findOne(term);
    return {
      ...rest,
      images: images.map((img) => img.url),
    };
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    const { images, ...toUpdate } = updateProductDto;

    const product = await this.productRepository.preload({
      id: id,
      ...toUpdate,
    });

    if (!product) {
      throw new NotFoundException(`product with id ${id} not found`);
    }

    //Create query runner
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (images) {
        await queryRunner.manager.delete(ProductImage, { product: { id } });
        product.images = images.map((image) =>
          this.productImageRepository.create({ url: image }),
        );
      }
      await queryRunner.manager.save(product);
      await queryRunner.commitTransaction(); // impacta el cambio
      await queryRunner.release(); // termina la conexion del queryRuner

      return this.findOnePlain(id);
    } catch (error) {
      await queryRunner.rollbackTransaction(); // deshace el cambio
      await queryRunner.release();
      this.handleDBExeptions(error);
    }
  }

  async remove(id: string) {
    const product = await this.findOne(id);
    await this.productRepository.remove(product);
  }

  async deleteAllProducts() {
    const queryBuilder = this.productRepository.createQueryBuilder('product');

    try {
      return await queryBuilder.delete().where({}).execute();
    } catch (error) {
      this.handleDBExeptions(error);
    }
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
