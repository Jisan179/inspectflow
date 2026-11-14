import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "@/app.module";
import { configureApp } from "@/app.setup";
import { env } from "@/config";

async function bootstrap() {
  // rawBody keeps the exact bytes of each request; the GitHub webhook needs
  // them to verify the HMAC signature.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  configureApp(app);

  const swagger = new DocumentBuilder()
    .setTitle("InspectFlow API")
    .setDescription(
      "Visual staging QA, bug annotation and PR sign-off hub. " +
        "Dashboard routes use a Bearer JWT; widget routes use X-InspectFlow-Key.",
    )
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, swagger));

  app.enableShutdownHooks();
  await app.listen(env.PORT, "0.0.0.0");
  console.log(`InspectFlow API listening on port ${env.PORT} (${env.NODE_ENV})`);
}

bootstrap();
