export type Team = "scientists" | "modelling" | "application";

export interface Person {
  id: string;
  name: string;
  role: string;
  team: Team;
  image: string;
  profileUrl?: string;
}

export interface TechnicalContact {
  name: string;
  role: string;
  email: string;
}

export interface ContactInformation {
  title: string;
  technicalContacts: readonly TechnicalContact[];
  technicalIssues: {
    title: string;
    organization: string;
    email: string;
    phone: string;
  };
}

export const people: readonly Person[] = [
  {
    id: "dr-k-p-suresh",
    name: "Dr. K P Suresh",
    role: "Principal Scientist",
    team: "scientists",
    image: "/assets/people/dr-k-p-suresh.png",
    profileUrl: "https://nivedi.res.in/drkpsuresh.php",
  },
  {
    id: "dr-jagadish-hiremath",
    name: "Dr.Jagadish hiremath",
    role: "Senior Scientist",
    team: "scientists",
    image: "/assets/people/dr-jagadish-hiremath.png",
    profileUrl: "https://www.nivedi.res.in/drjagadish.php",
  },
  {
    id: "dr-s-s-patil",
    name: "Dr. S. S. Patil",
    role: "Principal Scientist",
    team: "scientists",
    image: "/assets/people/dr-s-s-patil.jpg",
    profileUrl: "https://nivedi.res.in/drsspatil.php",
  },
  {
    id: "mangala-c-devihosoor",
    name: "Mangala C Devihosoor",
    role: "Project Research Scientist I",
    team: "modelling",
    image: "/assets/people/mangala-c-devihosoor.jpg",
  },
  {
    id: "devika-t-r",
    name: "Devika T R",
    role: "Project Technical Support-III",
    team: "application",
    image: "/assets/people/devika-t-r.png",
  },
  {
    id: "hamsadwaj-d",
    name: "Hamsadwaj D",
    role: "Project Assistant",
    team: "application",
    image: "/assets/people/hamsadwaj-d.png",
  },
];

export const contact: ContactInformation = {
  title: "Contact Information",
  technicalContacts: [
    {
      name: "Dr. K P Suresh",
      role: "Principal Scientist, ICAR NIVEDI",
      email: "suresh.kp@icar.org.in",
    },
    {
      name: "Dr. Jagadish Hiremath",
      role: "Senior Scientist, ICAR NIVEDI",
      email: "Jagadish.Hiremath@icar.org.in",
    },
  ],
  technicalIssues: {
    title: "Technical Issues",
    organization: "Disease Informatics Lab (SEL), ICAR NIVEDI",
    email: "dlinivedi@gmail.com",
    phone: "08023093188",
  },
};
