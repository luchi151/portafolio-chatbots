import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';

interface DemoCardProps {
  title: string;
  description: string;
  tags: readonly string[];
  href: string;
  icon: ReactNode;
  accentColor: string;
}

export function DemoCard({ title, description, tags, href, icon, accentColor }: DemoCardProps) {
  return (
    <Card className="flex flex-col transition-shadow hover:shadow-md">
      <CardHeader>
        <div
          className="mb-3 flex size-11 items-center justify-center rounded-xl"
          style={{ background: `${accentColor}18`, color: accentColor }}
        >
          {icon}
        </div>
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-wrap gap-1.5">
        {tags.map((tag) => (
          <Badge key={tag} variant="outline" className="text-xs">
            {tag}
          </Badge>
        ))}
      </CardContent>
      <CardFooter>
        <Link href={href} className={buttonVariants({ size: 'sm' })}>
          Probar Demo →
        </Link>
      </CardFooter>
    </Card>
  );
}
