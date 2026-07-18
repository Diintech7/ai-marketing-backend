class BaseRepository {
  constructor(model) {
    this.model = model;
  }

  findById(id, select = "") {
    return this.model.findById(id).select(select);
  }

  findOne(filter, select = "") {
    return this.model.findOne(filter).select(select);
  }

  find(filter = {}, options = {}) {
    const { sort = { createdAt: -1 }, limit = 20, skip = 0, populate = "" } = options;
    return this.model.find(filter).sort(sort).limit(limit).skip(skip).populate(populate);
  }

  count(filter = {}) {
    return this.model.countDocuments(filter);
  }

  create(data) {
    return this.model.create(data);
  }

  updateById(id, data) {
    return this.model.findByIdAndUpdate(id, data, { new: true });
  }

  deleteById(id) {
    return this.model.findByIdAndDelete(id);
  }
}

export default BaseRepository;
