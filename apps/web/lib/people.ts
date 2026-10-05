export interface Person {
  id: string;
  firstName: string;
  lastName: string;
}

export const fullName = (person: Pick<Person, 'firstName' | 'lastName'>) => `${person.firstName} ${person.lastName}`;
