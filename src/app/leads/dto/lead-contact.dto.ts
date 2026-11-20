import { ApiProperty } from '@nestjs/swagger';

export class LeadContactDto {
  @ApiProperty({ example: 'https://sonrisaclara.pe/' })
  website!: string;

  @ApiProperty({ type: String, nullable: true, example: 'citas@sonrisaclara.pe' })
  email!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '(01) 241-7788' })
  phone!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Av. Benavides 1920, Miraflores' })
  address!: string | null;
}
