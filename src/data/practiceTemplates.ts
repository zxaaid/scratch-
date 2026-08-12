import { PracticeTemplate } from '../types';

export const PRACTICE_TEMPLATES: PracticeTemplate[] = [
  {
    id: 'tpl_cursive_abc',
    title: 'Cursive Lowercase (a-z)',
    category: 'Cursive',
    referenceText: 'a b c d e f g h i j k l m n o p q r s t u v w x y z',
    description: 'Practice fluid cursive letter connections and loop height uniformity.',
  },
  {
    id: 'tpl_cursive_caps',
    title: 'Cursive Capitals (A-Z)',
    category: 'Cursive',
    referenceText: 'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z',
    description: 'Master elegant uppercase flourish curves and slant angle.',
  },
  {
    id: 'tpl_print_words',
    title: 'Print Pangram Practice',
    category: 'Print',
    referenceText: 'The quick brown fox jumps over the lazy dog',
    description: 'Ideal for testing baseline consistency, letter spacing, and character height.',
  },
  {
    id: 'tpl_calligraphy',
    title: 'Calligraphy Strokes',
    category: 'Calligraphy',
    referenceText: '||| /// ~~~ ((( ))) OOO AAA BBB CCC',
    description: 'Drill pressure variations, thick downstrokes, and hairline upstrokes.',
  },
  {
    id: 'tpl_math_symbols',
    title: 'Math & Equations',
    category: 'Math',
    referenceText: 'E = mc²   ∫ f(x)dx   f(x) = ax² + bx + c   πr²',
    description: 'Practice neat mathematical notation, superscripts, and integrals.',
  },
];
