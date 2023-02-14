export interface IDependency {}

export type IResponseType = {
  type: string;
};

export type IResponse = {
  type: IResponseType;
  message: string;
  code: string;
};

export interface IResponser {
  generateMessage(responseType: IResponseType): IResponse;
}

export interface IEntity extends IDependency {
  isValid(): Boolean;
  isEqual(entity: IEntity): Boolean;
  toJSON(): string;
}

export interface ProductProps {
  readonly id: string;
  readonly name: string;
  readonly buyingPrice: number;
  readonly sellingPrice: number;
}

export default class Product implements IEntity {
  private props: ProductProps;
  private responser: IResponser;

  constructor(props: ProductProps, responser: IResponser) {
    this.props = props;
    this.responser = responser;
  }

  public isValid(): Boolean {
    throw new Error("Method not implemented.");
  }

  public isEqual(entity: Product): Boolean {
    return this.props.id === entity.props.id;
  }

  public toJSON(): string {
    return JSON.stringify(this.props);
  }
}
