import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { MapPin, Plus, X } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';

const CityManager: React.FC = () => {
  const { cities, addCity, removeCity } = useAppContext();
  const [newCity, setNewCity] = useState('');

  const handleAddCity = () => {
    if (!newCity.trim()) return;
    addCity(newCity.trim());
    setNewCity('');
  };

  const handleRemoveCity = (city: string) => {
    removeCity(city);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddCity();
    }
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          City Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="newCity">Add New City</Label>
          <div className="flex gap-2">
            <Input
              id="newCity"
              placeholder="Enter city name"
              value={newCity}
              onChange={(e) => setNewCity(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1"
            />
            <Button 
              onClick={handleAddCity}
              disabled={!newCity.trim()}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <Label>Current Cities ({cities.length})</Label>
          <div className="flex flex-wrap gap-2">
            {cities.map((city) => (
              <Badge 
                key={city} 
                variant="secondary" 
                className="flex items-center gap-2 px-3 py-1"
              >
                {city}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveCity(city)}
                  className="h-4 w-4 p-0 hover:bg-red-100"
                >
                  <X className="w-3 h-3" />
                </Button>
              </Badge>
            ))}
          </div>
          {cities.length === 0 && (
            <p className="text-gray-500 text-sm">No cities added yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CityManager;