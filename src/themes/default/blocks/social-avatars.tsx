import Image from 'next/image';

import { Avatar } from '@/shared/components/ui/avatar';

const StarIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden
  >
    <path d="M12 2l2.47 5 5.53.8-4 3.9.94 5.5L12 14.8l-4.94 2.4.94-5.5-4-3.9 5.53-.8L12 2z" />
  </svg>
);

const userImgUrls = [
  '/imgs/avatars/1.png',
  '/imgs/avatars/2.png',
  '/imgs/avatars/3.png',
  '/imgs/avatars/4.png',
  '/imgs/avatars/5.png',
  '/imgs/avatars/6.png',
];

export function SocialAvatars({ tip }: { tip: string }) {
  return (
    <div className="mx-auto mt-8 flex w-fit flex-col items-center gap-2 sm:flex-row">
      <span className="mx-4 inline-flex items-center -space-x-2">
        {userImgUrls.map((url, index) => (
          <Avatar className="size-10 border" key={index}>
            <Image width={40} height={40} src={url} alt="placeholder" />
          </Avatar>
        ))}
      </span>
      <div className="flex flex-col items-center gap-1 md:items-start">
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, index) => (
            <StarIcon
              key={index}
              className="size-4 fill-yellow-400 text-yellow-400"
            />
          ))}
        </div>
        <p className="text-muted-foreground text-left text-sm font-normal">
          {tip}
        </p>
      </div>
    </div>
  );
}
