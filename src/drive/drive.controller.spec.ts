import { Test, TestingModule } from '@nestjs/testing';
import { DriveController } from './drive.controller';
import { DriveService } from './drive.service';

describe('DriveController', () => {
  let controller: DriveController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DriveController],
      providers: [DriveService],
    }).compile();

    controller = module.get<DriveController>(DriveController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
