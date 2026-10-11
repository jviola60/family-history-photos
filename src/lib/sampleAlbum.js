/**
 * Sample Vintage Family Album for instant zero-configuration testing
 */

export const SAMPLE_PEOPLE = {
  person_1: {
    id: 'person_1',
    name: 'Grandpa Arthur',
    relationship: 'Grandfather',
    branch: 'Miller Family (Mom\'s side)',
    avatarUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=300&q=80',
    embeddings: []
  },
  person_2: {
    id: 'person_2',
    name: 'Grandma Rose',
    relationship: 'Grandmother',
    branch: 'Miller Family (Mom\'s side)',
    avatarUrl: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?auto=format&fit=crop&w=300&q=80',
    embeddings: []
  },
  person_3: {
    id: 'person_3',
    name: 'Uncle David',
    relationship: 'Uncle',
    branch: 'Miller Family (Mom\'s side)',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
    embeddings: []
  },
  person_4: {
    id: 'person_4',
    name: 'Aunt Evelyn',
    relationship: 'Aunt',
    branch: 'Miller Family (Mom\'s side)',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
    embeddings: []
  }
};

export const SAMPLE_PHOTOS = [
  {
    id: 'sample_photo_1',
    name: 'Summer_Lake_Cabin_1972.jpg',
    relativePath: 'Summer_Lake_Cabin_1972.jpg',
    objectUrl: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=1200&q=80',
    size: 2450120,
    width: 1200,
    height: 800,
    lastModified: new Date('1972-07-15').getTime(),
    isMarkedDuplicate: false,
    people: ['Grandpa Arthur', 'Uncle David'],
    relationship: 'Grandfather',
    decade: '1970s',
    date: '1972-07-15',
    story: 'Fishing trip up at Lake George. Arthur caught his record 7-pound bass!',
    location: 'Lake George, NY',
    familyBranch: 'Miller Family (Mom\'s side)',
    tags: ['Cabin', 'Vacation', 'Fishing'],
    faces: [
      { id: 'f1', box: { x: 0.28, y: 0.22, width: 0.22, height: 0.32 }, name: 'Grandpa Arthur' },
      { id: 'f2', box: { x: 0.58, y: 0.25, width: 0.20, height: 0.30 }, name: 'Uncle David' }
    ]
  },
  {
    id: 'sample_photo_2',
    name: 'Summer_Lake_Cabin_1972_copy.jpg', // DUPLICATE COPY OF PHOTO 1
    relativePath: 'Summer_Lake_Cabin_1972_copy.jpg',
    objectUrl: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=400&q=40', // Lower-res duplicate
    size: 421000,
    width: 400,
    height: 267,
    lastModified: new Date('1972-07-15').getTime(),
    isMarkedDuplicate: false,
    people: ['Grandpa Arthur'],
    relationship: 'Grandfather',
    decade: '1970s',
    date: '1972-07-15',
    story: 'Lower resolution copy from old album',
    location: 'Lake George, NY',
    familyBranch: 'Miller Family (Mom\'s side)',
    tags: ['Cabin'],
    faces: []
  },
  {
    id: 'sample_photo_3',
    name: 'Grandma_Rose_Porch_1965_thumb.jpg', // SMALL THUMBNAIL PHOTO REQUIRING 4K ENHANCEMENT
    relativePath: 'Grandma_Rose_Porch_1965_thumb.jpg',
    objectUrl: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?auto=format&fit=crop&w=350&q=70',
    size: 89000,
    width: 350,
    height: 466,
    lastModified: new Date('1965-05-20').getTime(),
    isMarkedDuplicate: false,
    people: ['Grandma Rose'],
    relationship: 'Grandmother',
    decade: '1960s',
    date: '1965-05-20',
    story: 'Sitting in her garden chair drinking sweet tea on Sunday morning.',
    location: 'Savannah, Georgia',
    familyBranch: 'Miller Family (Mom\'s side)',
    tags: ['Porch', 'Portrait'],
    faces: [
      { id: 'f3', box: { x: 0.25, y: 0.15, width: 0.50, height: 0.55 }, name: 'Grandma Rose' }
    ]
  },
  {
    id: 'sample_photo_4',
    name: 'Wedding_Day_Evelyn_1981.jpg',
    relativePath: 'Wedding_Day_Evelyn_1981.jpg',
    objectUrl: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80',
    size: 3100200,
    width: 1200,
    height: 800,
    lastModified: new Date('1981-06-12').getTime(),
    isMarkedDuplicate: false,
    people: ['Aunt Evelyn'],
    relationship: 'Aunt',
    decade: '1980s',
    date: '1981-06-12',
    story: 'Evelyn\'s wedding day. It rained in the morning but cleared up right before vows!',
    location: 'Charleston, SC',
    familyBranch: 'Miller Family (Mom\'s side)',
    tags: ['Wedding', 'Celebration'],
    faces: [
      { id: 'f4', box: { x: 0.35, y: 0.20, width: 0.30, height: 0.40 }, name: 'Aunt Evelyn' }
    ]
  },
  {
    id: 'sample_photo_5',
    name: 'Wedding_Day_Evelyn_1981_dup.jpg', // DUPLICATE OF PHOTO 4
    relativePath: 'Wedding_Day_Evelyn_1981_dup.jpg',
    objectUrl: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80',
    size: 3100200,
    width: 1200,
    height: 800,
    lastModified: new Date('1981-06-12').getTime(),
    isMarkedDuplicate: false,
    people: [],
    relationship: '',
    decade: '',
    date: '',
    story: '',
    location: '',
    familyBranch: '',
    tags: [],
    faces: []
  },
  {
    id: 'sample_photo_6',
    name: 'Thanksgiving_Dinner_1988_unknown.jpg', // UNTAGGED PHOTO (FOR MOM TO SOLVE)
    relativePath: 'Thanksgiving_Dinner_1988_unknown.jpg',
    objectUrl: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1200&q=80',
    size: 1980000,
    width: 1200,
    height: 800,
    lastModified: new Date('1988-11-24').getTime(),
    isMarkedDuplicate: false,
    people: [], // UNTAGGED!
    relationship: '',
    decade: '1980s',
    date: '1988-11-24',
    story: 'Around the big oak table at Thanksgiving. Need Mom to remind us who is sitting at the head.',
    location: 'Home Dining Room',
    familyBranch: 'Miller Family (Mom\'s side)',
    tags: ['Thanksgiving', 'Holiday'],
    faces: [
      { id: 'f5', box: { x: 0.20, y: 0.25, width: 0.22, height: 0.32 }, name: '' },
      { id: 'f6', box: { x: 0.60, y: 0.22, width: 0.24, height: 0.34 }, name: '' }
    ]
  }
];
