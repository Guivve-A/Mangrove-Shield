import dynamic from 'next/dynamic';
import Head from 'next/head';

const MapDashboard = dynamic(() => import('../components/MapDashboard'), {
  ssr: false,
});

export default function HomePage(): JSX.Element {
  return (
    <>
      <Head>
        <title>MangroveShield Dashboard</title>
        <meta
          name="description"
          content="3D-ready coastal resilience dashboard for flood and mangrove prioritization"
        />
      </Head>
      <MapDashboard />
    </>
  );
}
