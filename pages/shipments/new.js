// pages/shipments/new.js
import { useRouter } from 'next/router';
import { useForm } from 'react-hook-form';

export default function NewShipment() {
  const { register, handleSubmit } = useForm();
  const router = useRouter();

  const onSubmit = async data => {
    const container_nos = data.containers.split('\n').filter(Boolean);
    await fetch('/api/shipments', {
      method: 'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({
        shipping_order_id: data.shipping_order_id,
        eta: data.eta,
        container_nos
      }),
    });
    router.push('/');
  };

  return (
    <div className="max-w-lg mx-auto p-4">
      <h1 className="text-2xl mb-4">New Shipment</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block">Shipping Order ID</label>
          <input
            {...register('shipping_order_id', { required:true })}
            className="border px-2 py-1 w-full"
          />
        </div>
        <div>
          <label className="block">ETA</label>
          <input
            {...register('eta', { required:true })}
            type="datetime-local"
            className="border px-2 py-1 w-full"
          />
        </div>
        <div>
          <label className="block">Container Nos (one per line)</label>
          <textarea
            {...register('containers', { required:true })}
            rows={5}
            className="border px-2 py-1 w-full font-mono"
          />
        </div>
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
          Save Shipment
        </button>
      </form>
    </div>
  );
}
