class CreateStations < ActiveRecord::Migration
  def change
    create_table :stations do |t|
      t.string :stationId
      t.string :stationName
      t.integer :lat
      t.integer :lng
      t.integer :bikes
      t.integer :docks
      t.timestamp :timestamp

      t.timestamps
    end
  end
end
