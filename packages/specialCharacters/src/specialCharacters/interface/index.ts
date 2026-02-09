export interface ISpecialCharactersOption {
  characters?: ISpecialCharacterGroup[]
  onSelect?: (char: string) => void
}

export interface ISpecialCharacterGroup {
  name: string
  characters: ISpecialCharacter[]
}

export interface ISpecialCharacter {
  char: string
  name: string
}
