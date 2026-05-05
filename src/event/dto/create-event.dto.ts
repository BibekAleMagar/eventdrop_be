import { IsString, IsNotEmpty, IsOptional, IsDateString } from "class-validator";

export class CreateEventDto {

    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsDateString()
    date: string;

}
