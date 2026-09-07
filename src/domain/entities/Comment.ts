export class Comment {
  constructor(
    public readonly id: string,
    public readonly ticketId: string,
    public readonly authorId: string,
    public content: string,
    public readonly isInternal: boolean,
    public readonly createdAt: Date,
  ) {}
}
