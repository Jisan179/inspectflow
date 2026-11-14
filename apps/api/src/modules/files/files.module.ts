import { Global, Module } from "@nestjs/common";
import { FilesController } from "./files.controller";
import { ImageService } from "./image.service";
import { RetentionService } from "./retention.service";

@Global()
@Module({
  controllers: [FilesController],
  providers: [ImageService, RetentionService],
  exports: [ImageService, RetentionService],
})
export class FilesModule {}
