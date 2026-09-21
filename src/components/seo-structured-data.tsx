import React from 'react';
import { PlatformFaq } from '@/lib/seo/platform-seo-data';

interface WebSiteSchemaProps {
  url: string;
  name: string;
  description: string;
}

export const WebSiteJsonLd: React.FC<WebSiteSchemaProps> = ({
  url,
  name,
  description,
}) => {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
    url,
    description,
    inLanguage: 'id',
  };

  return (
    <script
      key="website-jsonld"
      id="website-jsonld"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
};

interface WebAppSchemaProps {
  url: string;
  name: string;
  description: string;
}

export const WebAppJsonLd: React.FC<WebAppSchemaProps> = ({
  url,
  name,
  description,
}) => {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name,
    url,
    description,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'All',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'IDR',
    },
  };

  return (
    <script
      key="webapp-jsonld"
      id="webapp-jsonld"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
};

interface FaqSchemaProps {
  faqs: PlatformFaq[];
}

export const FaqJsonLd: React.FC<FaqSchemaProps> = ({ faqs }) => {
  if (!faqs || faqs.length === 0) return null;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  return (
    <script
      key="faq-jsonld"
      id="faq-jsonld"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
};

export interface BreadcrumbItem {
  name: string;
  url: string;
}

interface BreadcrumbSchemaProps {
  items: BreadcrumbItem[];
}

export const BreadcrumbJsonLd: React.FC<BreadcrumbSchemaProps> = ({ items }) => {
  if (!items || items.length === 0) return null;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <script
      key="breadcrumb-jsonld"
      id="breadcrumb-jsonld"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
};

